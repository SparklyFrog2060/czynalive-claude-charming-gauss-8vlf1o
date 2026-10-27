import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { ImportExportSection } from "@/components/settings/ImportExportSection";
import { InstallSection } from "@/components/settings/InstallSection";
import { MarkersSection } from "@/components/settings/MarkersSection";
import { MenuConfigSection } from "@/components/settings/MenuConfigSection";
import { BusWifiSection, DeparturesSection, LanguageSection, rebrand, ThemeSection, UpdateSection } from "@/components/settings/SimpleSections";
import { StartLocationSection } from "@/components/settings/StartLocationSection";

type Section = { titleKey?: string; documentTitleKey: string; render: () => ReactNode };

const SECTIONS: Record<string, Section> = {
    "wyglad-aplikacji": { titleKey: "settings.darkModeShortTitle", documentTitleKey: "settings.pageTitleDarkMode", render: () => <ThemeSection /> },
    language: { titleKey: "changeLanguage.language", documentTitleKey: "changeLanguage.chooseLanguage", render: () => <LanguageSection /> },
    lokalizacjastartowa: { titleKey: "settings.locationTitleShort", documentTitleKey: "settings.locationTitleShort", render: () => <StartLocationSection /> },
    "znaczniki-pojazdow": { titleKey: "settings.pageTitleMarkers", documentTitleKey: "settings.pageTitleMarkers", render: () => <MarkersSection /> },
    "przystanek-odjazdy": { titleKey: "settings.pageTitleTimetable", documentTitleKey: "settings.pageTitleTimetable", render: () => <DeparturesSection /> },
    "konfiguracja-menu": { titleKey: "settings.menuConfigTitle", documentTitleKey: "settings.menuConfigPageTitle", render: () => <MenuConfigSection /> },
    "aktualizacja-aplikacji": { documentTitleKey: "settings.pageTitleUpdate", render: () => <UpdateSection /> },
    "import-export-data": { titleKey: "settings.importExportTitle", documentTitleKey: "settings.importExportPageTitle", render: () => <ImportExportSection /> },
    instalacja: { titleKey: "settings.appInstallation", documentTitleKey: "settings.appInstallation", render: () => <InstallSection /> },
    buswifi: { titleKey: "settings.busWifiPageTitle", documentTitleKey: "settings.busWifiPageTitle", render: () => <BusWifiSection /> },
};

export default function SettingsSubPage() {
    const { section = "" } = useParams();
    const { t } = useTranslation();
    const config = SECTIONS[section];
    if (!config) return <Navigate to="/ustawienia" replace />;

    return (
        <PageTemplate title={config.titleKey ? t(config.titleKey) : undefined} padding>
            <PageHeader documentTitle={`${rebrand(t(config.documentTitleKey))} - Czynalive`} />
            {config.render()}
        </PageTemplate>
    );
}
