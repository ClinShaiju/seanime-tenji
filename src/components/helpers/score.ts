import { cn } from "@/lib/utils"

export function getScoreColor(score: number, kind: "audience" | "audience-icon" | "user"): string {
    if (score < 30) { // 0-29
        return cn(
            kind === "user" && "bg-red-500",
            kind === "audience" && "text-red-200",
            kind === "audience-icon" && "accent-red-200",
        )
    }
    if (score < 60) { // 30-59
        return cn(
            kind === "user" && "bg-amber-800/90",
            kind === "audience" && "text-amber-200",
            kind === "audience-icon" && "accent-amber-200",
        )
    }
    if (score < 70) { // 60-69
        return cn(
            kind === "user" && "bg-lime-800/90",
            kind === "audience" && "text-lime-200",
            kind === "audience-icon" && "accent-lime-200",
        )
    }
    if (score < 80) { // 70-79
        return cn(
            kind === "user" && "bg-emerald-800/90",
            kind === "audience" && "text-emerald-200",
            kind === "audience-icon" && "accent-emerald-200",
        )
    }
    if (score < 82) { // 80-81
        return cn(
            kind === "user" && "bg-emerald-800/90",
            kind === "audience" && "text-emerald-200",
            kind === "audience-icon" && "accent-emerald-200",
        )
    }
    // 90-100
    return cn(
        kind === "user" && "bg-indigo-600/90",
        kind === "audience" && "text-indigo-200",
        kind === "audience-icon" && "accent-indigo-200",
    )
}
