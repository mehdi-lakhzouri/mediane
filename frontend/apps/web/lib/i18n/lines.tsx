import { Fragment } from "react";

/**
 * Renders copy written as separate lines (line breaks differ between
 * languages, so they live in the messages, not the markup). A space follows
 * each break so words stay apart where the break is hidden by CSS.
 */
export function Lines({
  lines,
  breakClassName,
}: {
  lines: readonly string[];
  breakClassName?: string;
}) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <>
          <br className={breakClassName} />{" "}
        </>
      )}
      {line}
    </Fragment>
  ));
}
