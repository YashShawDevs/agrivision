declare module "react-native-gesture-handler" {
  import type { ComponentType, ReactNode } from "react";
  import type { ViewProps } from "react-native";

  export interface GestureHandlerRootViewProps extends ViewProps {
    children?: ReactNode;
  }

  export const GestureHandlerRootView: ComponentType<GestureHandlerRootViewProps>;
}
