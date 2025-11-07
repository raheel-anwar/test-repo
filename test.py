from typing import List, Any, Dict
from pydantic import BaseModel


class ExecutionEvent(BaseModel):
    name: str
    status: str          # RUNNING | COMPLETED | FAILED
    message: str | None
    details: Any | None
    error_message: str | None
    error_trace: str | None


# Mapping of Step Functions event types to generic statuses
_STATUS_MAP = {
    "ExecutionStarted": "RUNNING",
    "ExecutionSucceeded": "COMPLETED",
    "ExecutionFailed": "FAILED",
    "TaskStateEntered": "RUNNING",
    "TaskStateExited": "COMPLETED",
    "TaskScheduled": "RUNNING",
    "TaskStarted": "RUNNING",
    "TaskSucceeded": "COMPLETED",
    "TaskFailed": "FAILED",
    "LambdaFunctionFailed": "FAILED",
    "LambdaFunctionStarted": "RUNNING",
    "LambdaFunctionSucceeded": "COMPLETED",
}


def parse_stepfn_history(events: List[Dict]) -> List[ExecutionEvent]:
    parsed: List[ExecutionEvent] = []

    for ev in events:
        ev_type = ev.get("type")
        ev_details = ev.get(ev_type + "EventDetails", {})

        status = _STATUS_MAP.get(ev_type, "RUNNING")

        error_message = None
        error_trace = None
        message = None
        details = None

        # Error details
        if "error" in ev_details or "cause" in ev_details:
            error_message = ev_details.get("error")
            error_trace = ev_details.get("cause")
        else:
            # Normal details
            # Common payload fields: input, output, scheduledEventDetails, etc.
            message = ev_details.get("name") or ev_details.get("resource") or ev_type
            details = (
                ev_details.get("input")
                or ev_details.get("output")
                or ev_details.get("parameters")
                or ev_details
            )

        parsed.append(
            ExecutionEvent(
                name=ev_type,
                status=status,
                message=message,
                details=details,
                error_message=error_message,
                error_trace=error_trace,
            )
        )

    return parsed
