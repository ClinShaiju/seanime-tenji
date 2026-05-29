import * as React from "react"

type UsePaginatedItemsOptions<T> = {
    items: T[]
    pageSize: number
    resetKey?: string | number | null | undefined
}

export function usePaginatedItems<T>({ items, pageSize, resetKey }: UsePaginatedItemsOptions<T>) {
    const [page, setPage] = React.useState(0)

    const totalPages = React.useMemo(
        () => Math.max(1, Math.ceil(items.length / pageSize)),
        [items.length, pageSize],
    )

    const pagedItems = React.useMemo(() => {
        const start = page * pageSize
        return items.slice(start, start + pageSize)
    }, [items, page, pageSize])

    React.useEffect(() => {
        setPage(current => Math.min(current, Math.max(totalPages - 1, 0)))
    }, [totalPages])

    React.useEffect(() => {
        setPage(0)
    }, [resetKey])

    return {
        page,
        setPage,
        totalPages,
        pagedItems,
        hasMultiplePages: items.length > pageSize,
        totalCount: items.length,
    }
}