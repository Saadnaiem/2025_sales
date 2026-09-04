interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // Check if the D1 database is bound correctly in your Cloudflare Pages Settings
    if (!context.env || !context.env.DB) {
      return new Response(
        `Error,Message\n"Database configuration error","The D1 Database binding named 'DB' is missing. Please go to your Cloudflare Pages project under Settings > Functions -> D1 Database bindings and add a binding with the exact name 'DB' pointing to your D1 database."`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
          },
        }
      );
    }

    // Get limit and pagination parameters from request
    const url = new URL(context.request.url);
    const limitParam = url.searchParams.get('limit') || '25000';
    const offsetParam = url.searchParams.get('offset') || '0';
    const lastIdParam = url.searchParams.get('lastId');
    const debugParam = url.searchParams.get('debug');

    const limit = parseInt(limitParam, 10);
    const offset = parseInt(offsetParam, 10);

    let results: any[] = [];
    
    // We utilize auto-incrementing ID keyset pagination if provided (O(log N) speed)
    // and fall back to standard OFFSET pagination if not. This completely avoids 
    // SQLite full table scans and stays well under Cloudflare's 50ms CPU limit!
    try {
      if (lastIdParam !== null) {
        const lastId = parseInt(lastIdParam, 10);
        const stmt = context.env.DB.prepare("SELECT * FROM sales WHERE id > ? LIMIT ?").bind(lastId, limit);
        const res = await stmt.all();
        results = res.results || [];
      } else {
        // Fallback or page 1 fallback using OFFSET
        const stmt = context.env.DB.prepare("SELECT * FROM sales LIMIT ? OFFSET ?").bind(limit, offset);
        const res = await stmt.all();
        results = res.results || [];
      }
    } catch (sqlError: any) {
      return new Response(
        `Error,Message\n"SQL Execution Failure","Failed to run query on table 'sales': ${sqlError.message.replace(/"/g, '""')}"`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
          },
        }
      );
    }

    if (!results || results.length === 0) {
      // Return empty response with code 204 or empty string (not headers) 
      // so the frontend knows there's no more data in the pagination chain
      return new Response("", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    // Direct JSON output for debugging: If query param debug=true exists, output the raw row keys
    if (debugParam === 'true') {
      return new Response(JSON.stringify({
        rowCount: results.length,
        firstRowKeys: Object.keys(results[0]),
        firstRowValues: results[0]
      }, null, 2), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // List of keys exactly as the React app expects from a standard CSV upload
    const keys = [
      'DIVISION',
      'DEPARTMENT',
      'CATEGORY',
      'SUBCATEGORY',
      'CLASS',
      'BRAND',
      'BRANCH NAME',
      'BRANCH CODE',
      'ITEM CODE',
      'ITEM DESCRIPTION',
      'TYPE',
      'TYPE Plus',
      '2024 CASH SALES',
      '2024 CREDIT SALES',
      '2024 TOTAL SALES',
      '2025 CASH SALES',
      '2025 CREDIT SALES',
      '2025 TOTAL SALES'
    ];

    // Explicit dictionary map from standard uppercase React keys to your SQLite columns
    const keysToSqlColumnsMap: Record<string, string> = {
      'DIVISION': 'division',
      'DEPARTMENT': 'department',
      'CATEGORY': 'category',
      'SUBCATEGORY': 'subcategory',
      'CLASS': 'class',
      'BRAND': 'brand',
      'BRANCH NAME': 'branch_name',
      'BRANCH CODE': 'branch_code', // Will map if present or output empty
      'ITEM CODE': 'item_code',
      'ITEM DESCRIPTION': 'item_description',
      'TYPE': 'type',
      'TYPE Plus': 'type_plus',
      '2024 CASH SALES': 'sales_2024_cash',
      '2024 CREDIT SALES': 'sales_2024_credit',
      '2024 TOTAL SALES': 'sales_2024_total',
      '2025 CASH SALES': 'sales_2025_cash',
      '2025 CREDIT SALES': 'sales_2025_credit',
      '2025 TOTAL SALES': 'sales_2025_total'
    };

    // Helper to escape CSV values
    const escapeCsvValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 2. Generate CSV Header Row matching the exact React upload keys
    const headerRow = keys.join(',');
    
    // 3. Generate CSV rows mapping your dynamic SQLite column naming back to uppercase standard keys
    let csvContent = headerRow + '\n';
    const rowCount = results.length;
    for (let i = 0; i < rowCount; i++) {
      const row = results[i];
      let rowStr = '';
      for (let j = 0; j < keys.length; j++) {
        const key = keys[j];
        const dbCol = keysToSqlColumnsMap[key];
        const val = (dbCol && row[dbCol] !== undefined) ? row[dbCol] : '';
        rowStr += (j === 0 ? '' : ',') + escapeCsvValue(val);
      }
      csvContent += rowStr + '\n';
    }

    // Determine the last processed ID in this result slice to send back in headers
    let lastId = 0;
    const dbIdKey = Object.keys(results[0]).find(key => key.toLowerCase() === 'id');
    if (dbIdKey && results.length > 0) {
      lastId = results[results.length - 1][dbIdKey] || 0;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "X-Last-ID": String(lastId),             // Pass fast keyset pointer to client
        "Access-Control-Expose-Headers": "X-Last-ID" // Permit browser reading of custom ID header
      },
    });

  } catch (error: any) {
    return new Response(`Error,Message\n"Failed to fetch D1 Database structure","${error.message.replace(/"/g, '""')}"`, {
      status: 500,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }
};
