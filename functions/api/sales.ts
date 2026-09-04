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

    // Get all column keys directly from the database result (excluding the database id column)
    const dbColumns = Object.keys(results[0]).filter(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey !== 'id' && lowerKey !== '_id';
    });

    // Helper to escape CSV values
    const escapeCsvValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 2. Map SQLite column names back to standard CSV user-friendly headers
    // (e.g. "_2024_cash_sales" -> "2024 CASH SALES", "branch_name" -> "BRANCH NAME")
    const headerRow = dbColumns.map(key => {
      return key.toUpperCase().replace(/_/g, ' ').trim();
    }).join(',');
    
    // 3. Generate CSV rows using original SQLite values directly to prevent key mismatching!
    let csvContent = headerRow + '\n';
    const rowCount = results.length;
    for (let i = 0; i < rowCount; i++) {
      const row = results[i];
      let rowStr = '';
      for (let j = 0; j < dbColumns.length; j++) {
        const col = dbColumns[j];
        rowStr += (j === 0 ? '' : ',') + escapeCsvValue(row[col]);
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
