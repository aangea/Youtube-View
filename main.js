const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');

puppeteer.use(StealthPlugin());

async function autoViewYouTube(videoUrl, proxy) {
    let browser;
    try {
        // If proxy is provided, anonymize it
        const proxyUrl = proxy ? await proxyChain.anonymizeProxy(proxy) : null;

        // Launch Puppeteer with or without proxy
        browser = await puppeteer.launch({
            headless: true,
            args: proxyUrl ? [`--proxy-server=${proxyUrl}`] : [],
        });

        const page = await browser.newPage();

        // Set user-agent to make it look like a real browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        );

        // Navigate to the YouTube video URL
        console.log(`Navigating to ${videoUrl}`);
        await page.goto(videoUrl, {
            waitUntil: 'networkidle2',
        });

        // Wait for video to play (simulate a real user watching the video)
        const videoDuration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });

        if (videoDuration > 0) {
            console.log(`Video duration: ${videoDuration} seconds. Watching...`);
            await page.waitForTimeout(videoDuration * 1000);
        } else {
            console.log('Unable to determine video duration. Watching for 30 seconds as fallback.');
            await page.waitForTimeout(30000); // Fallback to 30 seconds
        }

        console.log('Finished watching the video.');
    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function main() {
    const videoUrl = 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID'; // Replace with your YouTube video URL
    const proxyFilePath = './proxies.txt'; // Path to the file containing proxy list

    try {
        // Read proxy list from file
        const proxies = fs.readFileSync(proxyFilePath, 'utf-8').split('\n').filter(Boolean);

        while (true) {
            for (const proxy of proxies) {
                console.log(`Using proxy: ${proxy}`);
                await autoViewYouTube(videoUrl, proxy);
            }
            console.log('Restarting the loop to watch the video again.');
        }
    } catch (error) {
        console.error('Error reading proxy file or processing proxies:', error);
    }
}

main();
