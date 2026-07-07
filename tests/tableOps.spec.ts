import { describe, expect, it } from 'vitest'
import {
  addColumnLeft,
  addColumnRight,
  addRowAbove,
  addRowBelow,
  getColumnCount,
  getRowCount,
  removeColumn,
  removeRow,
} from '@/utils/tableOps'

function createTable() {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = `
    <table>
      <thead><tr><th>H1</th><th>H2</th></tr></thead>
      <tbody>
        <tr><td>A1</td><td>A2</td></tr>
        <tr><td>B1</td><td>B2</td></tr>
      </tbody>
    </table>
  `
  return wrapper.querySelector('table')!
}

describe('tableOps', () => {
  it('adds a row above a header cell into tbody', () => {
    const table = createTable()
    const headerCell = table.querySelector('th')! as HTMLTableCellElement

    const newRow = addRowAbove(headerCell)

    expect(newRow).not.toBeNull()
    expect(table.querySelector('tbody')?.firstElementChild).toBe(newRow)
    expect(getRowCount(table)).toBe(4)
  })

  it('adds a row below a body cell', () => {
    const table = createTable()
    const bodyCell = table.querySelector('tbody td')! as HTMLTableCellElement

    const newRow = addRowBelow(bodyCell)

    expect(newRow).not.toBeNull()
    expect(getRowCount(table)).toBe(4)
  })

  it('adds a row below a header cell into the start of tbody', () => {
    const table = createTable()
    const headerCell = table.querySelector('th')! as HTMLTableCellElement

    const newRow = addRowBelow(headerCell)

    expect(newRow).not.toBeNull()
    expect(table.querySelector('tbody')?.firstElementChild).toBe(newRow)
    expect(getRowCount(table)).toBe(4)
  })

  it('creates a tbody when adding a row below a header cell in a header-only table', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<table><thead><tr><th>H1</th><th>H2</th></tr></thead></table>'
    const table = wrapper.querySelector('table')!
    const headerCell = table.querySelector('th')! as HTMLTableCellElement

    const newRow = addRowBelow(headerCell)

    const tbody = table.querySelector('tbody')
    expect(tbody).not.toBeNull()
    expect(tbody?.firstElementChild).toBe(newRow)
    expect(newRow?.querySelectorAll('td')).toHaveLength(2)
  })

  it('removes a body row when more than one remains', () => {
    const table = createTable()
    const firstBodyCell = table.querySelector('tbody td')! as HTMLTableCellElement

    expect(removeRow(firstBodyCell)).toBe(true)
    expect(getRowCount(table)).toBe(2)
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('appends a column when adding to the right of the last cell', () => {
    const table = createTable()
    const lastHeaderCell = table.querySelectorAll('th')[1] as HTMLTableCellElement

    addColumnRight(lastHeaderCell)

    expect(getColumnCount(table)).toBe(3)
    const headerCells = table.querySelectorAll('thead th')
    expect(headerCells).toHaveLength(3)
    // The appended header cell is the row's last child.
    expect(headerCells[2]).toBe(table.querySelector('thead tr')!.lastElementChild)
  })

  it('does not remove the last body row', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <table>
        <thead><tr><th>H1</th></tr></thead>
        <tbody><tr><td>A1</td></tr></tbody>
      </table>
    `
    const table = wrapper.querySelector('table')!
    const cell = table.querySelector('tbody td')! as HTMLTableCellElement

    expect(removeRow(cell)).toBe(false)
    expect(getRowCount(table)).toBe(2)
  })

  it('adds and removes columns correctly', () => {
    const table = createTable()
    const cell = table.querySelector('tbody td')! as HTMLTableCellElement

    addColumnLeft(cell)
    expect(getColumnCount(table)).toBe(3)

    addColumnRight(cell)
    expect(getColumnCount(table)).toBe(4)

    expect(removeColumn(cell)).toBe(true)
    expect(getColumnCount(table)).toBe(3)
  })

  it('does not remove the last column', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<table><tbody><tr><td>Only</td></tr></tbody></table>'
    const table = wrapper.querySelector('table')!
    const cell = table.querySelector('td')! as HTMLTableCellElement

    expect(removeColumn(cell)).toBe(false)
    expect(getColumnCount(table)).toBe(1)
  })
})
