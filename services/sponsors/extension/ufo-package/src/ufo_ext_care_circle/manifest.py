"""A reviewed self-host Python extension, using only public UFO SDK imports."""

import asyncio
import json

from pydantic import BaseModel, ConfigDict
from ufo.sdk.manifest import Manifest
from ufo.sdk.tools import TextContent, ToolContext, ToolDef, ToolResult

from .transport import ClinicTransportError, fetch_clinic

SDK_COMMIT = "63ba388ed449ff46c9d70744119dffc85df0fbf8"
TOOL_NAME = "care_circle_clinic_lookup"


class ClinicLookupInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


async def clinic_lookup(_ctx: ToolContext, _args: ClinicLookupInput) -> ToolResult:
    try:
        result = await asyncio.to_thread(fetch_clinic)
    except ClinicTransportError as error:
        return ToolResult(content=(TextContent(text=json.dumps({
            "error": {"code": error.code, "message": str(error)},
        })),), is_error=True, untrusted=True)
    return ToolResult(content=(TextContent(text=json.dumps(result)),), untrusted=True)


def manifest() -> Manifest:
    return Manifest(name="care-circle-clinic", version="0.1.0", tools=(
        ToolDef(
            name=TOOL_NAME,
            description="Read the fictional Care Circle clinic's contact details from the fixed local source. Synthetic data only. Not medical advice.",
            input_model=ClinicLookupInput,
            handler=clinic_lookup,
            untrusted=True,
            side_effecting=False,
            parallel_safe=True,
            binds_member_authority=False,
        ),
    ))
