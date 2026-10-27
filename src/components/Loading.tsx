import { Alert, Button } from "@mui/material";

export const Loading = () => (
    <div style={{ display: "grid", placeItems: "center", minHeight: "50dvh" }}>
        <div className="spinner" />
    </div>
);

export const ErrorBox = ({ error, onRetry }: { error: Error; onRetry?: () => void }) => (
    <Alert
        severity="error"
        sx={{ m: 2 }}
        action={
            onRetry && (
                <Button color="inherit" size="small" onClick={onRetry}>
                    Odśwież
                </Button>
            )
        }
    >
        Coś poszło nie tak... ({error.message})
    </Alert>
);
