function escapeForCmd(value: string) {
  return value.replace(/"/g, "\"\"");
}

const a = {
  user: {
    id: 12345,
    name: "Ruhan \"The Dev\"",
    email: "ruhan@example.com",
    roles: ["admin", "editor", "user"],
    preferences: {
      theme: "dark",
      notifications: {
        email: true,
        sms: false,
        push: ["news", "updates"],
      },
    },
    history: [
      {
        date: "2025-10-02T18:00:00Z",
        action: "login",
        success: true,
      },
      {
        date: "2025-10-02T18:30:00Z",
        action: "update_profile",
        success: true,
      },
      {
        date: "2025-10-02T19:00:00Z",
        action: "delete_item",
        success: false,
        error: "Permission denied",
      },
    ],
  },
  meta: {
    ip: "192.168.1.100",
    location: "Dhaka, Bangladesh",
    tags: ["test", "json", "clipboard", "complex"],
  },
  message: "This JSON contains special characters: \\ \" ' $ & < > ^ `",
};

const jsonString = JSON.stringify(a);
const escaped = escapeForCmd(jsonString);
const command = `echo "${escaped}" | clip`;

console.log(command);
