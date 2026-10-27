import { Fragment, type ReactNode } from "react";

// Minimal Markdown renderer for alert descriptions (paragraphs, lists, headings, bold/italic, links).
const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = pattern.exec(text))) {
        if (match.index > last) nodes.push(text.slice(last, match.index));
        const token = match[0];
        const key = `${keyPrefix}-${index++}`;
        if (token.startsWith("**") || token.startsWith("__")) {
            nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
        } else if (token.startsWith("*")) {
            nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
        } else if (token.startsWith("[")) {
            const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
            nodes.push(
                <a key={key} href={href} target="_blank" rel="nofollow noopener noreferrer">
                    {label}
                </a>,
            );
        } else {
            nodes.push(
                <a key={key} href={token} target="_blank" rel="nofollow noopener noreferrer">
                    {token}
                </a>,
            );
        }
        last = match.index + token.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
};

export const Markdown = ({ source }: { source: string }) => {
    const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
    return (
        <>
            {blocks.map((block, blockIndex) => {
                const lines = block.split("\n").filter((line) => line.trim() !== "");
                if (lines.length === 0) return null;
                const key = `b${blockIndex}`;
                if (lines.every((line) => /^\s*([-*+]|\d+[.)])\s+/.test(line))) {
                    const ordered = /^\s*\d/.test(lines[0]);
                    const items = lines.map((line, i) => <li key={i}>{renderInline(line.replace(/^\s*([-*+]|\d+[.)])\s+/, ""), `${key}-${i}`)}</li>);
                    return ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
                }
                const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
                if (heading && lines.length === 1) {
                    return (
                        <p key={key}>
                            <strong>{renderInline(heading[2], key)}</strong>
                        </p>
                    );
                }
                return (
                    <p key={key}>
                        {lines.map((line, i) => (
                            <Fragment key={i}>
                                {i > 0 && <br />}
                                {renderInline(line.replace(/^#{1,6}\s+/, "").replace(/^\s*([-*+])\s+/, "• "), `${key}-${i}`)}
                            </Fragment>
                        ))}
                    </p>
                );
            })}
        </>
    );
};
