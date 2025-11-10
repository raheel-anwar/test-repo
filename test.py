from functools import wraps
from fastapi import HTTPException, Depends

def org_allowed():
    async def dependency(request):
        user = request.state.user
        role = user.role
        return role.abac_constraints.get("organization", "all")
    return dependency


def require_org_access():
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, allowed_orgs=Depends(org_allowed()), **kwargs):
            # auto-detect “org” from path params
            org = kwargs.get("org")

            if org is None:
                raise HTTPException(status_code=500, detail="Org param missing")

            if allowed_orgs != "all":
                if isinstance(allowed_orgs, list):
                    if org not in allowed_orgs:
                        raise HTTPException(status_code=403, detail="Org access denied")
                else:
                    if org != allowed_orgs:
                        raise HTTPException(status_code=403, detail="Org access denied")

            return await func(*args, **kwargs)

        return wrapper
    return decorator
