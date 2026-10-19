class PlanError(Exception):
    """A planning failure that should be returned to the client."""

    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


class PlanInputError(PlanError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status=400)
