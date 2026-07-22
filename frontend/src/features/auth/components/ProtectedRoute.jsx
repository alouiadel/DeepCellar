import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchMe } from "@/features/auth/store/authSlice";

export default function ProtectedRoute() {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.auth);
  const location = useLocation();

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchMe());
    }
  }, [dispatch, status]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
