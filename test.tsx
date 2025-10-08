from sqlalchemy import select, func
from sqlalchemy.orm import aliased
from sqlalchemy import desc
from sqlalchemy import over
from models import ServiceRequestEvent

def get_latest_steps(session, request_id):
    # 1️⃣ Get the latest run_id for this request
    latest_run_subq = (
        select(ServiceRequestEvent.run_id)
        .where(ServiceRequestEvent.request_id == request_id)
        .order_by(ServiceRequestEvent.created_at.desc())
        .limit(1)
        .scalar_subquery()
    )

    # 2️⃣ Annotate each step with row number partitioned by step_name
    subq = (
        select(
            ServiceRequestEvent,
            func.row_number().over(
                partition_by=ServiceRequestEvent.step_name,
                order_by=ServiceRequestEvent.created_at.desc()
            ).label("rn")
        )
        .where(ServiceRequestEvent.request_id == request_id)
        .where(ServiceRequestEvent.run_id == latest_run_subq)
        .subquery()
    )

    # 3️⃣ Alias the subquery
    S = aliased(ServiceRequestEvent, subq)

    # 4️⃣ Select only rows where rn=1 (latest per step)
    query = select(S).where(subq.c.rn == 1).order_by(S.step_name)

    results = session.execute(query).scalars().all()
    return results
