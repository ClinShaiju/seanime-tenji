import { Easing, FadeInDown, FadeOutDown } from "react-native-reanimated"

export const Animations = {
    FadeInDown: FadeInDown
        .delay(300)
        .duration(500)
        .easing(Easing.elastic(1)),

    FadeOutDown: FadeOutDown
        .duration(300)
        .easing(Easing.elastic(1)),
}
