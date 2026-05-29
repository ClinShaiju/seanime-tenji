import { useAnilistCollectionLoader } from "@/api/loaders/collection.loaders"
import React from "react"

type ApiLoadersProps = {
    children: React.ReactNode
}

export function ApiLoaders(props: ApiLoadersProps) {

    const {
        children,
        ...rest
    } = props

    useAnilistCollectionLoader()

    return (
        <>
            {children}
        </>
    )
}
