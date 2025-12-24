
interface FetchResult {
    data: string | null;
    error: string | null;
}

const GDRIVE_ID = '1yqGiPMAQ8GMKeNvWWW6QeTvjOQ7Yz3Fg';

// List of proxies to try in order
const PROXIES = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`)}`,
    `https://corsproxy.io/?https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`)}`,
    `https://thingproxy.freeboard.io/fetch/https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`
];

export const fetchSalesData = async (onProgress: (message: string) => void): Promise<FetchResult> => {

    // 1. Try fetching local file first (best for production if file exists)
    try {
        onProgress('Checking for local data file...');
        const localPath = `${(import.meta as any).env.BASE_URL}sales_data.csv`.replace(/\/\//g, '/'); // Ensure double slashes are cleaned
        const response = await fetch(localPath);
        if (response.ok) {
            const csvText = await response.text();
            // Validation: Check if it looks like a real CSV, not an HTML 404 page
            if (!csvText.trim().startsWith('<!DOCTYPE html') && !csvText.trim().startsWith('<html') && csvText.length > 50) {
                return { data: csvText, error: null };
            }
        }
    } catch (e) {
        console.warn("Local file fetch failed, trying proxies...", e);
    }

    // 2. Try proxies
    for (const [index, url] of PROXIES.entries()) {
        try {
            onProgress(`Attempting download via proxy ${index + 1}...`);
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`Proxy ${index + 1} failed: ${response.statusText}`);
                continue;
            }

            const csvText = await response.text();

            // Basic validation to ensure we didn't just get an HTML error page from the proxy
            if (csvText.trim().startsWith('<') || csvText.length < 100) {
                throw new Error("Received invalid data (likely HTML error page)");
            }

            return { data: csvText, error: null };

        } catch (err) {
            console.warn(`Proxy ${index + 1} error:`, err);
            // Continue to next proxy
        }
    }

    return { data: null, error: "All data fetch attempts failed. Please verify internet connection or place 'sales_data.csv' in the public folder." };
};
