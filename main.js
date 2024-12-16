/* 
__  __           ______      __       
\ \/ /___  __  _/_  __/_  __/ /_  ___
 \  / __ \/ / / // / / / / / __ \/ _ \
 / / /_/ / /_/ // / / /_/ / /_/ /  __/
 /_/\____/\__,_//_/  \__,_/_.___/\___/

 Author @RichGank
*/

const fs = require('fs'); 
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');

puppeteer.use(StealthPlugin());

function getRandomDuration(minMinutes, maxMinutes) {
    const minSeconds = minMinutes * 60;
    const maxSeconds = maxMinutes * 60;
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
}

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:88.0) Gecko/20100101 Firefox/88.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function autoViewYouTube(videoUrl, proxies, processIndex, updateProgress) {
    let browser;
    let proxyIndex = 0;

    while (proxyIndex < proxies.length) {
        try {
            const proxy = proxies[proxyIndex];
            const proxyUrl = proxy ? await proxyChain.anonymizeProxy(proxy) : null;

            // Launch Puppeteer with or without proxy
            browser = await puppeteer.launch({
                headless: true,
                args: proxyUrl ? [`--proxy-server=${proxyUrl}`] : [],
            });

            const page = await browser.newPage();

            // Set random user-agent to make it look like a real browser
            await page.setUserAgent(getRandomUserAgent());

            // Navigate to the YouTube video URL
            updateProgress(processIndex, `Using proxy: ${proxy}`);
            updateProgress(processIndex, `Navigating to ${videoUrl}`);
            await page.goto(videoUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000, // Increase timeout to 60 seconds
            });

            // Wait for the video element to load
            await page.waitForSelector('video', { timeout: 30000 });

            // Get video duration
            const videoDuration = await page.evaluate(() => {
                const video = document.querySelector('video');
                return video ? video.duration : 0;
            });

            // Determine random watch duration between 5 and 12 minutes
            const randomWatchDuration = getRandomDuration(5, 12);

            if (videoDuration > 0) {
                const watchDuration = Math.min(randomWatchDuration, videoDuration);
                updateProgress(processIndex, `Video duration: ${Math.round(videoDuration)} seconds. Watching for ${watchDuration} seconds.`);

                // Watch the video and log progress for each process
                for (let elapsed = 1; elapsed <= watchDuration; elapsed++) {
                    updateProgress(processIndex, `Watching... ${elapsed}/${watchDuration} seconds elapsed.`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                updateProgress(processIndex, `Finished watching the video (${watchDuration} seconds).`);
            } else {
                updateProgress(processIndex, `Unable to determine video duration. Watching for 30 seconds as fallback.`);

                // Fallback to 30 seconds with progress logging
                const fallbackDuration = 30;
                for (let elapsed = 1; elapsed <= fallbackDuration; elapsed++) {
                    updateProgress(processIndex, `Watching... ${elapsed}/${fallbackDuration} seconds elapsed.`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                updateProgress(processIndex, `Finished watching the video (30 seconds fallback).`);
            }

            // If successful, exit the loop
            return;
        } catch (error) {
            updateProgress(processIndex, `Error with proxy ${proxies[proxyIndex]}: ${error.message}`);
            proxyIndex++;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    updateProgress(processIndex, `All proxies failed for process ${processIndex}.`);
}

async function startProcess(maxConcurrentProcesses) {
    const videoFilePath = './videos.txt'; // Path to the file containing video URLs
    const proxyFilePath = './proxies.txt'; // Path to the file containing proxy list

    try {
        // Read video URLs and proxy list from files
        const videoUrls = fs.readFileSync(videoFilePath, 'utf-8').split('\n').filter(Boolean);
        const proxies = fs.readFileSync(proxyFilePath, 'utf-8').split('\n').filter(Boolean);

        // Initialize progress tracking
        const progress = Array(maxConcurrentProcesses).fill('');

        // Function to update progress display
        function updateProgress(processIndex, message) {
            progress[processIndex - 1] = `Process ${processIndex}: ${message}`;
            console.clear();
            console.log(progress.join('\n'));
        }

        // Create a pool of processes
        const tasks = Array.from({ length: maxConcurrentProcesses }, (_, index) => {
            const videoUrl = videoUrls[index % videoUrls.length]; // Cycle through video URLs
            return autoViewYouTube(videoUrl, proxies, index + 1, updateProgress);
        });

        // Wait for all processes to complete
        await Promise.all(tasks);

        console.log('All processes completed. Restarting the loop.');

        // Restart the loop automatically after all processes are completed
        startProcess(maxConcurrentProcesses);
    } catch (error) {
        console.error('Error reading video or proxy files:', error);
    }
}

function promptInitialInput() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Enter the number of processes to run simultaneously: ', (input) => {
        const maxConcurrentProcesses = parseInt(input, 10);

        if (isNaN(maxConcurrentProcesses) || maxConcurrentProcesses <= 0) {
            console.error('Invalid number of processes. Please enter a positive integer.');
            readline.close();
            return;
        }

        readline.close();

        // Start the process
        startProcess(maxConcurrentProcesses);
    });
}

promptInitialInput();
