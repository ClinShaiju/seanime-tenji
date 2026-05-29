import Toast, { ToastShowParams } from "react-native-toast-message"

export const toast = {
    error: (message: string, params?: ToastShowParams) => {
        Toast.show({
            type: "error",
            position: "top",
            text2: message,
            visibilityTime: 2500,
            topOffset: 55,
            ...params,
        })
    },
    success: (message: string, params?: ToastShowParams) => {
        Toast.show({
            type: "success",
            position: "top",
            text2: message,
            visibilityTime: 2000,
            topOffset: 55,
            ...params,
        })
    },
    info: (message: string, params?: ToastShowParams) => {
        Toast.show({
            type: "info",
            position: "top",
            text2: message,
            visibilityTime: 2000,
            topOffset: 55,
            ...params,
        })
    },
    warning: (message: string, params?: ToastShowParams) => {
        Toast.show({
            type: "warning",
            position: "top",
            text2: message,
            visibilityTime: 2500,
            topOffset: 55,
            ...params,
        })
    },
}
