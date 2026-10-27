import { Box, Divider, Link, Typography } from "@mui/material";
import { useCities, type City } from "@/api/cities";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { APP_VERSION, AppLogo } from "@/components/settings/SimpleSections";
import { useSettings } from "@/store/settings";

type DataSource = { type: string; provider: string; providerUrl?: string };

const SOURCE_LABELS: Record<string, (city: string) => string> = {
    officialGTFS: (city) => `Rozkład jazdy w mieście ${city}`,
    GTFS: (city) => `Rozkład jazdy w mieście ${city}`,
    officialGPS: (city) => `Lokalizacja GPS pojazdów w mieście ${city}`,
    GPS: (city) => `Lokalizacja GPS pojazdów w mieście ${city}`,
    officialDelays: (city) => `Opóźnienia pojazdów w mieście ${city}`,
    Delays: (city) => `Opóźnienia pojazdów w mieście ${city}`,
};

const citySources = (city: City) =>
    Object.values(city.agencies ?? {}).flatMap((agency) =>
        ((agency as { dataSources?: DataSource[] }).dataSources ?? []).map((source) => ({ agency: agency.name, ...source })),
    );

export default function AboutPage() {
    const [settings] = useSettings();
    const { cities } = useCities();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    const ordered = [...cities.filter((city) => city.category !== "virtual" && citySources(city).length > 0)].sort((a, b) =>
        a.id === settings.city ? -1 : b.id === settings.city ? 1 : a.name.localeCompare(b.name, "pl"),
    );

    return (
        <PageTemplate padding>
            <PageHeader documentTitle="O aplikacji - Czynalive" />
            <div style={{ paddingTop: "20px", textAlign: "justify" }}>
                <div style={{ display: "grid", placeItems: "center" }}>
                    <AppLogo size={68} />
                </div>
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 1 }}>
                    <Typography variant="caption" gutterBottom>
                        v{APP_VERSION}
                    </Typography>
                </Box>
                <article>
                    <Typography variant="h2">O aplikacji</Typography>
                    <Divider sx={{ margin: "10px 0" }} />
                    <section>
                        <Typography variant="body2" gutterBottom>
                            <strong>Czynalive</strong> to aplikacja do śledzenia autobusów, tramwajów i pociągów na żywo: mapa pojazdów z kierunkiem jazdy, brygadą i opóźnieniem, odjazdy
                            z przystanków w czasie rzeczywistym, rozkłady jazdy linii, przystanków i brygad, komunikaty o utrudnieniach oraz statystyki opóźnień.
                        </Typography>
                    </section>
                    <Divider sx={{ margin: "10px 0" }} />
                    <Typography variant="h3">Dane:</Typography>
                    <Typography variant="body2" gutterBottom>
                        Wszystkie dane pochodzą z otwartego API{" "}
                        <Link href="https://zbiorkom.live" target="_blank" rel="noopener noreferrer nofollow" underline="hover">
                            zbiorkom.live
                        </Link>
                        , które zbiera i łączy dane przewoźników i organizatorów transportu. W razie rozbieżności wiążący jest rozkład organizatora.
                    </Typography>
                    {ordered.map((city) => (
                        <section key={city.id}>
                            <Typography variant="h4">{city.name}</Typography>
                            {citySources(city).map((source, index) => (
                                <Typography key={`${source.agency}-${source.type}-${index}`} variant="body2" gutterBottom>
                                    <strong>{(SOURCE_LABELS[source.type] ?? (() => source.type))(city.name)}</strong> ({source.agency}):{" "}
                                    {source.providerUrl ? (
                                        <Link href={source.providerUrl} target="_blank" rel="noopener noreferrer nofollow" underline="hover">
                                            {source.provider}
                                        </Link>
                                    ) : (
                                        source.provider
                                    )}
                                    , pozyskano: {today}.
                                </Typography>
                            ))}
                            <Divider sx={{ margin: "10px 0" }} />
                        </section>
                    ))}
                    <Typography variant="h3">Prywatność:</Typography>
                    <Typography variant="body2" gutterBottom>
                        Aplikacja nie wymaga konta. Ulubione, ustawienia i ostatnia pozycja mapy są zapisywane tylko w pamięci Twojej przeglądarki — możesz je przenieść na inne urządzenie
                        funkcją Import/Export ustawień. Lokalizacja GPS jest używana wyłącznie na urządzeniu, do pokazania najbliższych przystanków.
                    </Typography>
                </article>
            </div>
        </PageTemplate>
    );
}
