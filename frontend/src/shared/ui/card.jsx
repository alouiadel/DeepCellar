import * as React from "react";
import { cn } from "@/shared/lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-xl shadow-black/40",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn("text-center text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }) {
  return <div className={cn("p-6", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
