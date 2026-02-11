import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import styles from "./App.module.css";

const API_URL = "http://localhost:3000/api";
const ADMIN_ID = 12345678; // Сюда свой ID

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [slotsCount, setSlotsCount] = useState(5);

  const queryClient = useQueryClient();

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
  }, []);

  // 1. Получение данных
  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/events`);
      return res.data;
    },
  });

  // 2. Создание тренировки
  const createEventMutation = useMutation({
    mutationFn: (newEvent) => axios.post(`${API_URL}/events`, newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setIsModalOpen(false);
    },
  });

  // 3. Запись на слот
  const bookingMutation = useMutation({
    mutationFn: (newBooking) => axios.post(`${API_URL}/bookings`, newBooking),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  // 4. Отмена записи
  const cancelMutation = useMutation({
    mutationFn: (data) => axios.delete(`${API_URL}/bookings`, { data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  // 5. Удаление тренировки (админ)
  const deleteEventMutation = useMutation({
    mutationFn: (eventId) => axios.delete(`${API_URL}/events/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const user = WebApp.initDataUnsafe.user || {
    id: 12345678,
    first_name: "Тестер",
  };
  const isAdmin = user.id === ADMIN_ID;

  const handleJoin = (eventId, slotIndex) => {
    if (bookingMutation.isPending) return;
    bookingMutation.mutate({
      event_id: eventId,
      slot_index: slotIndex,
      user_id: user.id,
      user_name: user.first_name,
      user_photo: user.photo_url || "",
    });
  };

  const handleCancel = (eventId, slotIndex) => {
    if (window.confirm("Отменить запись?")) {
      cancelMutation.mutate({
        event_id: eventId,
        slot_index: slotIndex,
        user_id: user.id,
      });
    }
  };

  const handleCreateEvent = () => {
    if (!eventDate) return alert("Выбери время!");
    createEventMutation.mutate({
      creator_id: user.id,
      slots_count: parseInt(slotsCount),
      start_time: new Date(eventDate).toISOString(),
    });
  };

  if (isLoading) return <div className={styles.loader}>Загрузка базы...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Тренировки</h1>
          <p className={styles.subtitle}>Привет, {user.first_name}</p>
        </div>
      </header>

      <div className={styles.list}>
        {events?.map((event) => (
          <div key={event.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.eventDate}>
                {new Date(event.start_time).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </h3>
              {isAdmin && (
                <button
                  className={styles.deleteEventBtn}
                  onClick={() =>
                    window.confirm("Удалить всё событие?") &&
                    deleteEventMutation.mutate(event.id)
                  }
                >
                  🗑️
                </button>
              )}
            </div>

            <div className={styles.grid}>
              {[...Array(event.slots_count)].map((_, i) => {
                const booking = event.participants?.find(
                  (p) => p.slot_index === i,
                );
                const isMyBooking = booking?.user_id === user.id;

                return (
                  <div key={i} className={styles.slot}>
                    {booking ? (
                      <div
                        className={`${styles.occupied} ${isMyBooking ? styles.mySlot : ""}`}
                        onClick={() => isMyBooking && handleCancel(event.id, i)}
                      >
                        {isMyBooking ? (
                          <span className={styles.myLabel}>
                            Это вы (отменить?)
                          </span>
                        ) : (
                          <span className={styles.userName}>
                            {isAdmin ? booking.user_name : "Занято"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        className={`${styles.joinBtn} ${bookingMutation.isPending ? styles.loading : ""}`}
                        disabled={
                          bookingMutation.isPending || cancelMutation.isPending
                        }
                        onClick={() => handleJoin(event.id, i)}
                      >
                        {bookingMutation.isPending ? "..." : "Записаться"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <button className={styles.fab} onClick={() => setIsModalOpen(true)}>
          +
        </button>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Новая тренировка</h2>
            <label className={styles.label}>Дата и время:</label>
            <input
              type="datetime-local"
              className={styles.input}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <label className={styles.label}>Количество мест:</label>
            <input
              type="number"
              className={styles.input}
              value={slotsCount}
              onChange={(e) => setSlotsCount(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button
                className={styles.createBtn}
                onClick={handleCreateEvent}
                disabled={createEventMutation.isPending}
              >
                {createEventMutation.isPending ? "Создание..." : "Создать"}
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => setIsModalOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
