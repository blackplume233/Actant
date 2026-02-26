import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">{t("notFound.code")}</p>
      <p className="mt-4 text-lg text-muted-foreground">{t("notFound.message")}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("notFound.backHome")}
        </Link>
      </Button>
    </div>
  );
}
