"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to SchoolSync Journal</CardTitle>
          <CardDescription>Your digital tool for managing classes, attendance, and grades.</CardDescription>
        </CardHeader>
        <CardContent>
          Get started by exploring the features in the sidebar.
        </CardContent>
      </Card>
    </div>
  );
}
