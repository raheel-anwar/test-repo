from pydantic import BaseModel
from typing import Generic, TypeVar, List, Optional

T = TypeVar("T")

class PaginatedResult(BaseModel, Generic[T]):
    data: List[T]
    count: int                      # number of items in this page
    next_page_token: Optional[str] = None
    approx_total: Optional[int] = None  # approximate total of filtered items

class WorkflowService:
    def __init__(self, temporal_client: Client):
        self.client = temporal_client

    @staticmethod
    def build_query(filters: Optional[WorkflowFilter]) -> str:
        if not filters:
            return ""
        query_parts = []
        if filters.workflow_id__eq:
            query_parts.append(f"WorkflowId='{filters.workflow_id__eq}'")
        if filters.workflow_type__icontains:
            query_parts.append(f"WorkflowType LIKE '%{filters.workflow_type__icontains}%'")
        if filters.status__in:
            statuses = " OR ".join(f"ExecutionStatus='{s.value}'" for s in filters.status__in)
            query_parts.append(f"({statuses})")
        if filters.start_time__gte:
            query_parts.append(f"StartTime>='{filters.start_time__isoformat()}'")
        if filters.start_time__lte:
            query_parts.append(f"StartTime<='{filters.start_time__isoformat()}'")
        if filters.end_time__gte:
            query_parts.append(f"CloseTime>='{filters.end_time__isoformat()}'")
        if filters.end_time__lte:
            query_parts.append(f"CloseTime<='{filters.end_time__isoformat()}'")
        return " AND ".join(query_parts)

    async def list_workflows(
        self,
        filters: Optional[WorkflowFilter] = None,
        page_size: int = DEFAULT_PAGE_SIZE,
        next_page_token: Optional[bytes] = None,
        sorting: Optional[SortingParams] = None,
        approximate_total: bool = True
    ) -> PaginatedResult[WorkflowExecutionRead]:

        page_size = min(page_size, MAX_PAGE_SIZE)
        query = self.build_query(filters)

        # Fetch workflows from Temporal
        response = await self.client.list_workflow_executions(
            query=query,
            page_size=page_size,
            next_page_token=next_page_token
        )

        workflows = [
            WorkflowExecutionRead(
                workflow_id=w.execution.workflow_id,
                run_id=w.execution.run_id,
                workflow_type=w.type.name,
                status=WorkflowStatus(w.status.name),
                start_time=w.start_time,
                end_time=w.end_time
            )
            for w in response.executions
        ]

        # Optional in-memory sort
        if sorting and sorting.sort_by:
            reverse = sorting.sort_order == "desc"
            workflows.sort(key=lambda w: getattr(w, sorting.sort_by, None), reverse=reverse)

        # Approximate total
        total_estimate = len(workflows)
        if approximate_total:
            # Fetch one additional workflow to see if there are more pages
            if response.next_page_token:
                total_estimate += 1  # we know there’s at least one more workflow

        return PaginatedResult(
            data=workflows,
            count=len(workflows),
            next_page_token=response.next_page_token.decode() if response.next_page_token else None,
            approx_total=total_estimate
        )


@router.get("/workflows", response_model=PaginatedResult[WorkflowExecutionRead])
async def list_workflows(
    filters: WorkflowFilter = Depends(),
    page_size: int = DEFAULT_PAGE_SIZE,
    next_page_token: Optional[str] = None,
    sorting: SortingParams = Depends(),
    temporal_client: Client = Depends(get_temporal_client)
):
    service = WorkflowService(temporal_client)
    result = await service.list_workflows(
        filters=filters,
        page_size=page_size,
        next_page_token=next_page_token.encode() if next_page_token else None,
        sorting=sorting,
    )
    return result
