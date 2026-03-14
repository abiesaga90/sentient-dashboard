import { useState, useMemo } from "react";
import { Table, Thead, Th, Tbody, Tr, Td } from "../ui/Table";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortKey?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
  maxHeight?: string;
}

export function DataTable<T>({
  columns,
  data,
  defaultSort,
  defaultDir = "asc",
  maxHeight,
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState(defaultSort || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortCol);
    if (!col?.sortKey) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = col.sortKey!(a);
      const vb = col.sortKey!(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [data, sortCol, sortDir, columns]);

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
  }

  return (
    <div className={maxHeight ? `overflow-y-auto ${maxHeight}` : undefined}>
      <Table>
        <Thead>
          <tr>
            {columns.map((col) => (
              <Th
                key={col.key}
                className={`cursor-pointer select-none ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`}
                onClick={() => col.sortKey && handleSort(col.key)}
              >
                {col.header}
                {sortCol === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </Th>
            ))}
          </tr>
        </Thead>
        <Tbody>
          {sorted.map((row, i) => (
            <Tr key={i}>
              {columns.map((col) => (
                <Td
                  key={col.key}
                  className={`${col.align === "right" ? "text-right" : ""} ${col.className || ""}`}
                >
                  {col.render(row)}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
