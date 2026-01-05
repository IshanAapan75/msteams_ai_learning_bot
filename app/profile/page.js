"use client";

import { useState, useEffect } from "react";

const UserProfilePage = () => {
  const [user, setUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  // Hardcoded for now, should be replaced with actual logged in user
  const userId = "user-alex";

  useEffect(() => {
    if (userId) {
      fetch(`/api/user/profile?userId=${userId}`)
        .then((res) => res.json())
        .then((data) => {
          setUser(data);
          setFormData({
            name: data.name,
            role: data.role,
          });
        });
    }
  }, [userId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, ...formData }),
    })
      .then((res) => res.json())
      .then((updatedUser) => {
        setUser(updatedUser);
        setIsEditMode(false);
      });
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h1>User Profile</h1>
      <div>
        <strong>Name:</strong>{" "}
        {isEditMode ? (
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
          />
        ) : (
          user.name
        )}
      </div>
      <div>
        <strong>Email:</strong> {user.email}
      </div>
      <div>
        <strong>Role:</strong>{" "}
        {isEditMode ? (
          <input
            type="text"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
          />
        ) : (
          user.role
        )}
      </div>
      <div>
        <strong>XP:</strong> {user.xp}
      </div>
      <div>
        <strong>Level:</strong> {user.level}
      </div>
      <div>
        <strong>Fluency Score:</strong> {user.fluencyScore}
      </div>
      <div style={{ marginTop: "20px" }}>
        {isEditMode ? (
          <>
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setIsEditMode(false)} style={{ marginLeft: "10px" }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setIsEditMode(true)}>Edit</button>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
