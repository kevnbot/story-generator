"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    logger.error("global error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
