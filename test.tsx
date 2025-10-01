# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = "postgresql+asyncpg://user:password@localhost:5432/mydb"

engine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_async_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# app/models/execution.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import datetime

class Base(DeclarativeBase):
    pass

class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str]
    status: Mapped[str]
    owner: Mapped[str]
    secret_token: Mapped[str]  # excluded from filtering
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)


# app/schemas/query.py
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class PaginationParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    page: int = Field(1, ge=1)
    page_size: int = Field(10, ge=1, le=100)

class SortingParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field("asc", pattern="^(asc|desc)$")

class FilterParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Example: filters[created_at][gte]=2025-01-01
    filters: Optional[Dict[str, Dict[str, Any]]] = None


# app/utils/query.py
from sqlalchemy import asc, desc
from sqlalchemy.sql import Select

OPERATORS = {
    "eq": lambda col, val: col == val,
    "neq": lambda col, val: col != val,
    "gt": lambda col, val: col > val,
    "gte": lambda col, val: col >= val,
    "lt": lambda col, val: col < val,
    "lte": lambda col, val: col <= val,
    "contains": lambda col, val: col.contains(val),
    "icontains": lambda col, val: col.ilike(f"%{val}%"),
    "in": lambda col, val: col.in_(val if isinstance(val, list) else str(val).split(",")),
}

def apply_filters(query: Select, filters: dict, allowed_map: dict) -> Select:
    if not filters:
        return query
    for field, ops in filters.items():
        column = allowed_map.get(field)
        if not column:
            continue
        for op, value in ops.items():
            operator_func = OPERATORS.get(op)
            if operator_func:
                query = query.where(operator_func(column, value))
    return query

def apply_sorting(query: Select, sort_by: str, sort_order: str, allowed_map: dict) -> Select:
    if not sort_by:
        return query
    column = allowed_map.get(sort_by)
    if not column:
        return query
    return query.order_by((desc if sort_order == "desc" else asc)(column))

def get_model_columns(model, exclude: set[str] = None) -> dict[str, any]:
    exclude = exclude or set()
    return {
        col.key: getattr(model, col.key)
        for col in model.__table__.columns
        if col.key not in exclude
    }


# app/repository/base.py
from typing import Generic, TypeVar, Type, Dict, Any, Optional
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.query import PaginationParams, SortingParams, FilterParams
from app.utils.query import apply_filters, apply_sorting

ModelType = TypeVar("ModelType")

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], allowed_map: dict[str, Any]):
        self.model = model
        self.allowed_map = allowed_map

    async def get_by_id(self, db: AsyncSession, obj_id: Any) -> Optional[ModelType]:
        result = await db.execute(select(self.model).where(self.model.id == obj_id))
        return result.scalars().first()

    async def get_all(
        self,
        db: AsyncSession,
        pagination: PaginationParams,
        sorting: SortingParams,
        filters: FilterParams,
    ) -> Dict[str, Any]:
        query = select(self.model)
        query = apply_filters(query, filters.filters, self.allowed_map)
        query = apply_sorting(query, sorting.sort_by, sorting.sort_order, self.allowed_map)

        # total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        # pagination
        query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
        result = await db.execute(query)
        items = result.scalars().all()

        return {"data": items, "total": total}

    async def create(self, db: AsyncSession, obj_in: Dict[str, Any]) -> ModelType:
        obj = self.model(**obj_in)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, obj_id: Any, obj_in: Dict[str, Any]) -> Optional[ModelType]:
        await db.execute(update(self.model).where(self.model.id == obj_id).values(**obj_in))
        await db.commit()
        return await self.get_by_id(db, obj_id)

    async def delete(self, db: AsyncSession, obj_id: Any) -> None:
        await db.execute(delete(self.model).where(self.model.id == obj_id))
        await db.commit()


# app/repository/execution.py
from app.repository.base import BaseRepository
from app.models.execution import Execution
from app.utils.query import get_model_columns

class ExecutionRepository(BaseRepository[Execution]):
    def __init__(self):
        allowed_map = get_model_columns(Execution, exclude={"secret_token"})
        super().__init__(Execution, allowed_map)


# app/api/executions.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_db
from app.schemas.query import PaginationParams, SortingParams, FilterParams
from app.repository.execution import ExecutionRepository

router = APIRouter()
repo = ExecutionRepository()

@router.get("/executions")
async def list_executions(
    pagination: PaginationParams = Depends(),
    sorting: SortingParams = Depends(),
    filters: FilterParams = Depends(),
    db: AsyncSession = Depends(get_async_db),
):
    return await repo.get_all(db, pagination, sorting, filters)

@router.get("/executions/{execution_id}")
async def get_execution(execution_id: int, db: AsyncSession = Depends(get_async_db)):
    return await repo.get_by_id(db, execution_id)


GET /executions?page=1&page_size=20

GET /executions?filters[status][eq]=running

GET /executions?filters[created_at][gte]=2025-01-01&filters[created_at][lte]=2025-12-31

GET /executions?sort_by=created_at&sort_order=desc

