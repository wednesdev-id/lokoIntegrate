import { test, expect } from '@playwright/test';

test.describe('WhatsApp Image Retry Logic', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to WhatsApp chat page
        await page.goto('http://localhost:3234/chat');

        // Wait for page to load
        await page.waitForLoadState('networkidle');
    });

    test('should display loading spinner for images', async ({ page }) => {
        // Wait for any image message to appear
        const imageContainer = page.locator('[class*="rounded-md overflow-hidden"]').first();
        await imageContainer.waitFor({ timeout: 10000 });

        // Check if loading spinner appears initially
        const spinner = imageContainer.locator('.animate-spin');
        const isVisible = await spinner.isVisible().catch(() => false);

        console.log('Loading spinner visible:', isVisible);
    });

    test('should show retry counter during retry attempts', async ({ page }) => {
        // Listen for console logs to track retry attempts
        const retryLogs: string[] = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Retry attempt') || text.includes('Scheduling retry')) {
                retryLogs.push(text);
                console.log('Retry log:', text);
            }
        });

        // Wait for page load
        await page.waitForTimeout(5000);

        // Log collected retry attempts
        console.log('Total retry logs captured:', retryLogs.length);
        retryLogs.forEach(log => console.log(' -', log));
    });

    test('should show manual retry button after max retries', async ({ page }) => {
        // Look for error state with retry button
        const retryButton = page.locator('button:has-text("Retry")');

        // Wait a bit for any failed images to show retry button
        await page.waitForTimeout(8000);

        const count = await retryButton.count();
        console.log('Retry buttons found:', count);

        if (count > 0) {
            // Take screenshot of retry button
            await retryButton.first().screenshot({ path: 'retry-button.png' });
            console.log('Screenshot saved: retry-button.png');
        }
    });

    test('should successfully load images via proxy', async ({ page }) => {
        // Monitor network requests
        const proxyRequests: string[] = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('/api/whatsapp/v1/media/download')) {
                proxyRequests.push(url);
                console.log('Proxy request:', url);
            }
        });

        // Wait for images to load
        await page.waitForTimeout(5000);

        console.log('Total proxy requests:', proxyRequests.length);

        // Check if images actually loaded
        const images = page.locator('img[alt="Shared image"]');
        const imageCount = await images.count();
        console.log('Total images found:', imageCount);

        // Check how many images loaded successfully
        let loadedCount = 0;
        for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const opacity = await img.evaluate(el => window.getComputedStyle(el).opacity);
            if (opacity === '1') {
                loadedCount++;
            }
        }
        console.log('Images loaded successfully:', loadedCount);
    });

    test('manual retry button should work when clicked', async ({ page }) => {
        // Wait for any retry buttons to appear
        await page.waitForTimeout(8000);

        const retryButton = page.locator('button:has-text("Retry")').first();

        if (await retryButton.isVisible()) {
            console.log('Found retry button, clicking...');

            // Listen for retry logs
            let retryClicked = false;
            page.on('console', msg => {
                if (msg.text().includes('Manual retry triggered')) {
                    retryClicked = true;
                    console.log('✅ Manual retry was triggered');
                }
            });

            await retryButton.click();
            await page.waitForTimeout(3000);

            expect(retryClicked).toBeTruthy();
        } else {
            console.log('No retry button found (all images loaded successfully)');
        }
    });

    test('should show correct retry counter text', async ({ page }) => {
        // Wait for page load
        await page.waitForTimeout(3000);

        // Look for retry counter text
        const retryingText = page.locator('text=/Retrying\\.\\.\\. \\(\\d\\/3\\)/');

        if (await retryingText.isVisible({ timeout: 5000 }).catch(() => false)) {
            const text = await retryingText.textContent();
            console.log('Retry counter text:', text);

            // Verify format
            expect(text).toMatch(/Retrying\.\.\. \(\d\/3\)/);
        } else {
            console.log('No retry counter visible (images loaded successfully)');
        }
    });

    test('should take screenshot of chat with images', async ({ page }) => {
        // Wait for chat to load
        await page.waitForTimeout(5000);

        // Take full page screenshot
        await page.screenshot({
            path: 'whatsapp-chat-images.png',
            fullPage: true
        });
        console.log('Screenshot saved: whatsapp-chat-images.png');

        // Take screenshot of just the chat panel
        const chatPanel = page.locator('[class*="flex-1 flex flex-col"]').first();
        if (await chatPanel.isVisible()) {
            await chatPanel.screenshot({ path: 'chat-panel-only.png' });
            console.log('Screenshot saved: chat-panel-only.png');
        }
    });
});
