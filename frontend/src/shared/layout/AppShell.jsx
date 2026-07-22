import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "@/features/auth/store/authSlice";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);

  async function onLogout() {
    await dispatch(logout());
    navigate("/login");
  }

  const label = user
    ? `${user.first_name || ""} ${user.last_name || ""} — @${user.username}`.trim()
    : "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <span>DeepCellar</span>
        </div>
        <nav className="flex gap-1">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                isActive && "bg-primary/15 text-primary",
              )
            }
          >
            Chat
          </NavLink>
          <NavLink
            to="/models"
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                isActive && "bg-primary/15 text-primary",
              )
            }
          >
            Models
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {label}
          </span>
          <Button variant="secondary" size="sm" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
