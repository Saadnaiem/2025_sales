
interface FetchResult {
    data: string | null;
    error: string | null;
}

const GDRIVE_ID = '14kcUoSBdErxO2f5nE-oVggWDGxUOAGyt';

// Cloudflare Pages D1 SQLite API Function relative URL
const CLOUDFLARE_URL = '/api/sales';

// List of proxies to try in order
const PROXIES = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`)}`,
    `https://corsproxy.io/?https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`)}`,
    `https://thingproxy.freeboard.io/fetch/https://drive.google.com/uc?export=download&id=${GDRIVE_ID}`
];

export const fetchSalesData = async (onProgress: (message: string) => void): Promise<FetchResult> => {

    // 1. Try Cloudflare Pages D1 SQLite API first (Fastest, secure & most up-to-date)
    // We fetch in paginated keyset chunks to bypass Cloudflare's serverless CPU execution and memory limitations!
    try {
        onProgress('Connecting to Cloudflare D1...');
        const CHUNK_SIZE = 25000;
        let lastId: string | null = null;
        let offset = 0;
        let combinedCsvText = '';
        let hasMoreData = true;
        let chunkIndex = 1;

        while (hasMoreData) {
            onProgress(`Loading secure records from Cloudflare D1 (Page ${chunkIndex})...`);
            
            // Build the URL, switching to lightning-fast O(log N) keyset lastId pagination after page 1
            let requestUrl = `${CLOUDFLARE_URL}?limit=${CHUNK_SIZE}`;
            if (lastId) {
                requestUrl += `&lastId=${lastId}`;
            } else {
                requestUrl += `&offset=${offset}`;
            }

            const response = await fetch(requestUrl);

            if (!response.ok) {
                let errorDetails = response.statusText;
                try {
                    const text = await response.text();
                    if (text.startsWith('Error,Message')) {
                        // Extract the message from the custom D1 error CSV response
                        const parts = text.split('\n')[1]?.split(',');
                        if (parts && parts.length > 1) {
                            errorDetails = parts.slice(1).join(',').replace(/^"|"$/g, '');
                        }
                    }
                } catch (e) {
                    console.error("Could not parse Error response", e);
                }
                throw new Error(`D1 query failed at offset ${offset}: ${errorDetails}`);
            }

            const chunkText = await response.text();
            const trimmedChunk = chunkText.trim();

            if (trimmedChunk === '' || trimmedChunk.startsWith('Error,Message')) {
                hasMoreData = false;
                break;
            }

            // Retrieve the custom header indicating the last ID processed (to avoid costly unindexed OFFSET operations)
            lastId = response.headers.get('X-Last-ID');

            // If it's the first page, we grab the Header and the data.
            // If it's subsequent pages, we strip the header row so rows align continuously!
            if (offset === 0) {
                combinedCsvText += chunkText;
            } else {
                const lines = chunkText.split('\n');
                // Remove header line
                lines.shift();
                const cleanText = lines.join('\n');
                if (cleanText.trim().length > 0) {
                    combinedCsvText += '\n' + cleanText;
                }
            }

            // Parse lines in chunk to estimate if we have reached the end of the SQLite table
            const rowCountInChunk = chunkText.split('\n').filter(Boolean).length - 1; // subtract header, guard empty lines
            if (rowCountInChunk < CHUNK_SIZE - 2) {
                // Not a full chunk, SQL returned less than the Limit, therefore we loaded everything!
                hasMoreData = false;
            } else {
                offset += CHUNK_SIZE;
                chunkIndex++;
            }
        }

        if (combinedCsvText.trim().length > 200) {
            return { data: combinedCsvText, error: null };
        } else {
            console.warn("Cloudflare D1 returned empty rows or connection timed out, trying fallback...");
        }
    } catch (err: any) {
        console.warn("Cloudflare D1 fast query failed. Resorting to local file fallback...", err);
        // Direct diagnostic helper: If we are on live domain, return the database error immediately 
        // to prevent the rating-limit gray page from the outdated public proxy fallbacks
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
            return {
                data: null,
                error: `Cloudflare Database Error: ${err.message || 'Connection Interrupted'}. Please verify your Cloudflare Pages Settings -> Functions -> D1 Database Binding.`
            };
        }
    }

    // 2. Try fetching local file second (best fallback if on localhost or testing)
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
        console.warn("Local file fetch failed, trying GDrive...", e);
    }

    // 3. Fallover to Google Drive Proxies (As a backup of last resort)
    for (const [index, url] of PROXIES.entries()) {
        try {
            onProgress(`Attempting fallback via proxy ${index + 1}...`);
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

    return { 
        data: null, 
        error: "Automatic download failed. Please upload the 'sales_data.csv' file manually." 
    };
};
