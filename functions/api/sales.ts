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

    // 1. Fetch all rows from your SQLite tables in D1
    // Adjust the table name 'sales' if you named it differently
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM sales"
    ).all();

    if (!results || results.length === 0) {
      return new Response("DIVISION,DEPARTMENT,CATEGORY,SUBCATEGORY,CLASS,BRAND,BRANCH NAME,BRANCH CODE,ITEM CODE,ITEM DESCRIPTION,TYPE,TYPE Plus,2024 CASH SALES,2024 CREDIT SALES,2024 TOTAL SALES,2025 CASH SALES,2025 CREDIT SALES,2025 TOTAL SALES\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    // List of keys in order to build correct CSV structure (what the React app expects)
    const keys = [
      'DIVISION', 'DEPARTMENT', 'CATEGORY', 'SUBCATEGORY', 'CLASS',
      'BRAND', 'BRANCH NAME', 'BRANCH CODE', 'ITEM CODE', 'ITEM DESCRIPTION',
      'TYPE', 'TYPE Plus',
      '2024 CASH SALES', '2024 CREDIT SALES', '2024 TOTAL SALES',
      '2025 CASH SALES', '2025 CREDIT SALES', '2025 TOTAL SALES'
    ];

    // Helper to map DB column keys case-insensitively or via underscore mappings
    const escapeCsvValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Helper to find the matching column in the database row regardless of formatting
    const findValueInRow = (row: any, targetKey: string) => {
      // 1. Direct match (e.g. "DIVISION", "BRANCH NAME")
      if (row[targetKey] !== undefined) return row[targetKey];

      // 2. Direct lowercase match (e.g. "division")
      const lowerKey = targetKey.toLowerCase();
      if (row[lowerKey] !== undefined) return row[lowerKey];

      // 3. Underscore lowercase match (e.g. "branch_name", "type_plus")
      const snakeKey = targetKey.replace(/\s+/g, '_').toLowerCase();
      if (row[snakeKey] !== undefined) return row[snakeKey];

      // 4. Compact lowercase match (e.g. "branchcode", "2024cashsales")
      const compactKey = targetKey.replace(/[^A-Z0-9]/gi, '').toLowerCase();
      if (row[compactKey] !== undefined) return row[compactKey];

      // 5. Cloudflare D1 CSV importing often prefix numbers with underscores (e.g. "_2024_cash_sales" or "_2024_total_sales")
      const prefixedSnakeKey = `_${snakeKey}`;
      if (row[prefixedSnakeKey] !== undefined) return row[prefixedSnakeKey];

      const prefixedCompactKey = `_${compactKey}`;
      if (row[prefixedCompactKey] !== undefined) return row[prefixedCompactKey];

      // fallback: look for dynamic keys where alphanumeric values match
      const cleanTarget = targetKey.replace(/[^A-Z0-9]/gi, '').toLowerCase();
      for (const actualKey of Object.keys(row)) {
        if (actualKey.replace(/[^A-Z0-9]/gi, '').toLowerCase() === cleanTarget) {
          return row[actualKey];
        }
      }

      return '';
    };

    // 2. Generate CSV Header Row
    const headerRow = keys.join(',');

    // 3. Generate CSV Data Rows
    const dataRows = results.map((row: any) => {
      return keys.map(key => escapeCsvValue(findValueInRow(row, key))).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
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
