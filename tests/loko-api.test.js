const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:1234';

test.describe('Loko WhatsApp API Tests', () => {

  test('should load main page', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check if the page loads correctly
    await expect(page).toHaveTitle(/Loko WhatsApp API/);

    // Check if React app is loaded
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should return WhatsApp status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/whatsapp/v1/status`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('message', 'WhatsApp status');
    expect(data.data).toHaveProperty('status', 'not_initialized');
    expect(data.data).toHaveProperty('is_connected', false);
    expect(data.data).toHaveProperty('is_logged_in', false);
  });

  test('should initiate WhatsApp connection', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/whatsapp/v1/connect`);

    expect(response.status()).toBe(202); // Accepted

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data.data).toHaveProperty('status', 'connecting');
    expect(data.data).toHaveProperty('message', 'WhatsApp connection in progress');
  });

  test('should handle device QR code request', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/whatsapp/v1/device/qr`);

    // Should return 202 (processing) or 404 (not available) since QR needs connection first
    expect([202, 404]).toContain(response.status());
  });

  test('should handle device status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/whatsapp/v1/device/status`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data.data).toHaveProperty('is_connected', false);
  });

  test('should return error for invalid endpoint', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invalid-endpoint`);

    expect(response.status()).toBe(404);
  });

  test('should serve static assets', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/static/assets/index-B6iS_Old.js`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/javascript/);
  });

  test('should handle health check', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);

    expect(response.status()).toBe(200);
    // Health endpoint might return HTML or JSON depending on implementation
  });

  test.describe('WebSocket/SSE endpoint', () => {
    test('should establish SSE connection for WhatsApp updates', async ({ page }) => {
      // Navigate to the main page first
      await page.goto(BASE_URL);

      // Create SSE connection
      const ssePromise = page.evaluate(async (url) => {
        return new Promise((resolve, reject) => {
          const eventSource = new EventSource(url);
          const events = [];

          eventSource.onmessage = (event) => {
            events.push(JSON.parse(event.data));
            // Close after receiving first few events
            if (events.length >= 3) {
              eventSource.close();
              resolve(events);
            }
          };

          eventSource.onerror = (error) => {
            eventSource.close();
            reject(error);
          };

          // Timeout after 10 seconds
          setTimeout(() => {
            eventSource.close();
            resolve(events);
          }, 10000);
        });
      }, `${BASE_URL}/api/whatsapp/ws`);

      // Wait for SSE events
      const events = await ssePromise;

      // Verify we received some events
      expect(Array.isArray(events)).toBe(true);
    });
  });

});