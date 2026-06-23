from datetime import datetime, timedelta
from langchain_core.messages import BaseMessage


class SessionStore:
    """In-memory session store with TTL eviction. Key: '{user_id}:{session_id}'."""

    def __init__(self, ttl_minutes: int = 120, max_messages: int = 40):
        self._sessions: dict[str, dict] = {}
        self._actions: dict = {}
        self._ttl = timedelta(minutes=ttl_minutes)
        self._max = max_messages

    def _evict_expired(self):
        now = datetime.now()
        expired = [k for k, v in self._sessions.items() if now - v["last_accessed"] > self._ttl]
        for k in expired:
            del self._sessions[k]

    def get_history(self, session_key: str) -> list[BaseMessage]:
        self._evict_expired()
        entry = self._sessions.get(session_key)
        if entry is None:
            return []
        entry["last_accessed"] = datetime.now()
        return list(entry["messages"])

    def update_history(self, session_key: str, messages: list[BaseMessage]):
        self._sessions[session_key] = {
            "messages": messages[-self._max:],
            "last_accessed": datetime.now(),
        }

    def set_last_action(self, session_key: str, action: dict):
        self._actions[session_key] = action

    def get_last_action(self, session_key: str) -> dict | None:
        return self._actions.get(session_key)

    def clear_last_action(self, session_key: str):
        self._actions.pop(session_key, None)

    def delete_session(self, session_key: str):
        self._sessions.pop(session_key, None)
        self._actions.pop(session_key, None)

    def session_count(self) -> int:
        return len(self._sessions)


# Singleton
session_store = SessionStore()
