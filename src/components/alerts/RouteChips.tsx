import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple, type RouteTuple } from "@/api/types";
import { RouteChip } from "@/components/departures/RouteChip";
import { ShowMoreButton } from "@/components/stats/common";

type Props = {
    routes: RouteTuple[];
    mode?: "preview" | "all";
    previewLength?: number;
    linked?: boolean;
};

// Chips of the lines an alert affects; "preview" collapses the rest into "i N innych".
export const RouteChips = ({ routes, mode = "preview", previewLength = 4, linked = false }: Props) => {
    const [expanded, setExpanded] = useState(false);
    const preview = routes.slice(0, previewLength);
    const rest = routes.slice(preview.length);

    const chip = (route: RouteTuple) => {
        const element = <RouteChip name={route[ERouteTuple.routeName]} type={route[ERouteTuple.routeType]} />;
        const key = `${route[ERouteTuple.city]}/${route[ERouteTuple.routeId]}`;
        if (!linked) return <span key={key}>{element}</span>;
        return (
            <Link
                key={key}
                to={`/${route[ERouteTuple.city]}/rozklad-jazdy/linia/${encodeURIComponent(route[ERouteTuple.routeId])}`}
                style={{ textDecoration: "none" }}
            >
                {element}
            </Link>
        );
    };

    const toggle = <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />;

    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 0.5,
            }}
        >
            {preview.map(chip)}
            {mode === "preview" ? (
                rest.length > 0 && (
                    <Box component="span" sx={{ alignSelf: "baseline" }}>
                        <Typography component="span" variant="caption">
                            <Trans i18nKey="alerts.andXMore" values={{ count: rest.length }} components={[<strong key="1" />]} />
                        </Typography>
                    </Box>
                )
            ) : (
                <>
                    {rest.length > 0 && toggle}
                    {expanded && (
                        <>
                            {rest.map(chip)}
                            {rest.length > 5 && toggle}
                        </>
                    )}
                </>
            )}
        </Box>
    );
};
