import ExcelJS from "exceljs";

export type ExcelColumn<T> = {
  header: string;
  key: string;
  width?: number;
  // A currency format ("#,##0.00") on a numeric value — money is always
  // exported as a real number, never a pre-formatted string, so the sheet
  // stays sortable/summable in Excel.
  numFmt?: string;
  value: (row: T) => string | number | Date;
};

// One shared builder every report's export route calls — the only thing
// that differs between reports is which columns/rows it's given, never how
// the workbook itself gets built.
export async function buildExcelBuffer<T>(sheetName: string, columns: ExcelColumn<T>[], rows: T[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 20,
    style: column.numFmt ? { numFmt: column.numFmt } : undefined,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((column) => [column.key, column.value(row)])));
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// A generous but bounded row count for "export the currently filtered
// result set" — every report's list-page query helper (getSales,
// getPurchases, ...) is built around pagination (page/perPage), so export
// reuses that exact same function with perPage set to this instead of a
// second, unpaginated implementation of the same filters.
export const EXPORT_MAX_ROWS = 100_000;

export function excelFileResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
