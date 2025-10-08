from sqlalchemy import select, func
from sqlalchemy.orm import aliased
from models import ServiceRequestEvent

def get_latest_steps(session, request_id):
    # 1️⃣ Get the latest run_id for this request
    latest_run_subq = (
        select(func.max(ServiceRequestEvent.run_id))
        .where(ServiceRequestEvent.request_id == request_id)
        .scalar_subquery()
    )

    # 2️⃣ Alias for self-join to get latest event per step
    S1 = aliased(ServiceRequestEvent)
    S2 = aliased(ServiceRequestEvent)

    # 3️⃣ Get the latest event per step
    latest_steps_subq = (
        select(
            S1.step_name,
            func.max(S1.created_at).label("latest_created_at")
        )
        .where(S1.request_id == request_id)
        .where(S1.run_id == latest_run_subq)
        .group_by(S1.step_name)
        .subquery()
    )

    # 4️⃣ Join back to get full event row
    query = (
        select(S1)
        .join(
            latest_steps_subq,
            (S1.step_name == latest_steps_subq.c.step_name) &
            (S1.created_at == latest_steps_subq.c.latest_created_at)
        )
        .where(S1.request_id == request_id)
        .where(S1.run_id == latest_run_subq)
        .order_by(S1.step_name)
    )

    results = session.execute(query).scalars().all()
    return results
