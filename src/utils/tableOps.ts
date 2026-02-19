/* ================================================================== */
/*  tableOps.ts — Table row / column manipulation                      */
/* ================================================================== */

/**
 * Get the column index of a cell within its row.
 */
export function getCellIndex(cell: HTMLTableCellElement): number {
  const row = cell.parentElement as HTMLTableRowElement | null
  if (!row) return 0
  return Array.from(row.cells).indexOf(cell)
}

/**
 * Get the total number of columns in a table (from the first row).
 */
export function getColumnCount(table: HTMLTableElement): number {
  const firstRow = table.querySelector('tr')
  return firstRow ? firstRow.cells.length : 0
}

/**
 * Get the total number of rows in a table.
 */
export function getRowCount(table: HTMLTableElement): number {
  return table.querySelectorAll('tr').length
}

/* ------------------------------------------------------------------ */
/*  Row operations                                                     */
/* ------------------------------------------------------------------ */

/**
 * Insert a new row above the row containing `cell`.
 */
export function addRowAbove(cell: HTMLTableCellElement): HTMLTableRowElement | null {
  const row = cell.closest('tr')
  if (!row) return null
  const table = cell.closest('table')
  if (!table) return null

  const colCount = getColumnCount(table)
  const newRow = createDataRow(colCount)

  // If inserting above a header row, insert into tbody instead
  if (row.parentElement?.tagName === 'THEAD') {
    let tbody = table.querySelector('tbody')
    if (!tbody) {
      tbody = document.createElement('tbody')
      table.appendChild(tbody)
    }
    tbody.insertBefore(newRow, tbody.firstChild)
  } else {
    row.parentNode?.insertBefore(newRow, row)
  }
  return newRow
}

/**
 * Insert a new row below the row containing `cell`.
 */
export function addRowBelow(cell: HTMLTableCellElement): HTMLTableRowElement | null {
  const row = cell.closest('tr')
  if (!row) return null
  const table = cell.closest('table')
  if (!table) return null

  const colCount = getColumnCount(table)
  const newRow = createDataRow(colCount)

  // If the current row is in thead, insert at the start of tbody
  if (row.parentElement?.tagName === 'THEAD') {
    let tbody = table.querySelector('tbody')
    if (!tbody) {
      tbody = document.createElement('tbody')
      table.appendChild(tbody)
    }
    tbody.insertBefore(newRow, tbody.firstChild)
  } else {
    row.parentNode?.insertBefore(newRow, row.nextSibling)
  }
  return newRow
}

/**
 * Remove the row containing `cell`.
 * Returns false if the row cannot be removed (last data row).
 */
export function removeRow(cell: HTMLTableCellElement): boolean {
  const row = cell.closest('tr')
  if (!row) return false
  const table = cell.closest('table')
  if (!table) return false

  // Don't remove the header row
  if (row.parentElement?.tagName === 'THEAD') return false

  // Don't remove the last body row
  const tbody = table.querySelector('tbody')
  if (tbody && tbody.querySelectorAll('tr').length <= 1) return false

  row.remove()
  return true
}

/* ------------------------------------------------------------------ */
/*  Column operations                                                  */
/* ------------------------------------------------------------------ */

/**
 * Insert a new column to the left of `cell`.
 */
export function addColumnLeft(cell: HTMLTableCellElement): void {
  const table = cell.closest('table')
  if (!table) return
  const colIdx = getCellIndex(cell)
  insertColumnAt(table, colIdx)
}

/**
 * Insert a new column to the right of `cell`.
 */
export function addColumnRight(cell: HTMLTableCellElement): void {
  const table = cell.closest('table')
  if (!table) return
  const colIdx = getCellIndex(cell)
  insertColumnAt(table, colIdx + 1)
}

/**
 * Remove the column that `cell` belongs to.
 * Returns false if the column cannot be removed (last column).
 */
export function removeColumn(cell: HTMLTableCellElement): boolean {
  const table = cell.closest('table')
  if (!table) return false
  const colIdx = getCellIndex(cell)
  const colCount = getColumnCount(table)

  // Don't remove the last column
  if (colCount <= 1) return false

  const rows = Array.from(table.querySelectorAll('tr'))
  for (const row of rows) {
    const cells = row.cells
    if (colIdx < cells.length) {
      cells[colIdx].remove()
    }
  }
  return true
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createDataRow(colCount: number): HTMLTableRowElement {
  const tr = document.createElement('tr')
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td')
    td.innerHTML = '&nbsp;'
    tr.appendChild(td)
  }
  return tr
}

function insertColumnAt(table: HTMLTableElement, colIdx: number): void {
  const rows = Array.from(table.querySelectorAll('tr'))
  for (const row of rows) {
    const isHeader = row.parentElement?.tagName === 'THEAD'
    const newCell = document.createElement(isHeader ? 'th' : 'td')
    newCell.innerHTML = isHeader ? 'Header' : '&nbsp;'

    const cells = row.cells
    if (colIdx >= cells.length) {
      row.appendChild(newCell)
    } else {
      row.insertBefore(newCell, cells[colIdx])
    }
  }
}
