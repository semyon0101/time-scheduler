import json

from sqlalchemy import Column, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from backend.Entities.database import Base


class Engineer(Base):
    __tablename__ = "engineers"

    id = Column(String, primary_key=True, index=True)
    dispatcher_id = Column(String, ForeignKey("dispatchers.id", ondelete="CASCADE"), primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lon = Column(Float, nullable=False)
    shift_start = Column(String, default="09:00")
    shift_end = Column(String, default="22:00")
    skills_json = Column(Text, default="[]")
    transport_type = Column(String, default="Автомобиль")
    status = Column(String, default="active")  # "active" | "unavailable" | "new"

    dispatcher = relationship("Dispatcher", back_populates="engineers")

    @property
    def skills(self):
        try:
            return json.loads(self.skills_json)
        except Exception:
            return []

    @skills.setter
    def skills(self, val):
        self.skills_json = json.dumps(val, ensure_ascii=False)
