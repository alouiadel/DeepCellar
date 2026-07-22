import { Provider } from "react-redux";
import { store } from "@/app/store";

export default function AppProviders({ children }) {
  return <Provider store={store}>{children}</Provider>;
}
