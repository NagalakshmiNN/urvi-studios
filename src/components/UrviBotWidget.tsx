"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────────────── */

type Message = {
  id: string;
  type: "bot" | "user";
  text: string;
};

type QuickReply = {
  label: string;
  action: () => void;
};

type ProductCard = {
  name: string;
  price: string;
  href: string;
  emoji: string;
};

type UrviBotWidgetProps = {
  imageA: string; // mascot-ivory
  imageB: string; // mascot-mustard
  visible: boolean; // controlled by parent (delayed after walkers)
  onHidePermanently?: () => void;
};

/* ─── Styles (inline to keep single-file) ────────────────────────────── */

const COLORS = {
  olive: "#3F4827",
  gold: "#A98238",
  ivory: "#F7F0E4",
  sage: "#6A7444",
  sand: "#EFE4D0",
  earth: "#51462F",
};

/* ─── Component ──────────────────────────────────────────────────────── */

export default function UrviBotWidget({ imageA, imageB, visible, onHidePermanently }: UrviBotWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [typing, setTyping] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  // Hide on admin pages
  if (pathname?.startsWith("/admin")) return null;

  const nextId = () => {
    idCounter.current += 1;
    return `msg-${idCounter.current}`;
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const addBotMsg = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        setTyping(true);
        scrollToBottom();
        setTimeout(() => {
          setTyping(false);
          setMessages((prev) => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, type: "bot", text }]);
          scrollToBottom();
          resolve();
        }, 700);
      });
    },
    []
  );

  const addUserMsg = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, type: "user", text }]);
    setProducts([]);
    scrollToBottom();
  }, []);

  /* ─── Conversation Flows ─── */

  const startConversation = useCallback(async () => {
    setReplies([]);
    await addBotMsg(`Namaste! I'm <img src="${imageA}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;object-position:top;vertical-align:middle;margin:0 2px;" alt="Nikhila"/> <b>Nikhila</b> and this is <img src="${imageB}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;object-position:top;vertical-align:middle;margin:0 2px;" alt="Shristi"/> <b>Shristi</b>! 🙏`);
    await addBotMsg("Welcome to Urvi Studios! How can we help you today?");
    setReplies([
      { label: "🛍️ Browse Collections", action: () => flowBrowse() },
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "✨ What's New", action: () => flowNewArrivals() },
      { label: "📏 Size Guide", action: () => flowSizeGuide() },
      { label: "📞 Contact Us", action: () => flowContact() },
    ]);
  }, [addBotMsg]);

  const flowBrowse = async () => {
    addUserMsg("Browse Collections");
    setReplies([]);
    await addBotMsg("Here are our collections! What catches your eye? 👀");
    setReplies([
      { label: "👗 Sarees", action: () => flowCategory("Sarees", "/shop?cat=Occasion") },
      { label: "🧵 Kurtis", action: () => flowCategory("Kurtis", "/shop?cat=Everyday") },
      { label: "💼 Office Wear", action: () => flowCategory("Office Wear", "/shop?cat=Office") },
      { label: "🛍️ Shop All", action: () => flowShopAll() },
      { label: "⬅️ Back", action: () => backToMain() },
    ]);
  };

  const flowCategory = async (cat: string, href: string) => {
    addUserMsg(cat);
    setReplies([]);
    await addBotMsg(`Great choice! Let me show you our ${cat.toLowerCase()} collection.`);
    await addBotMsg(`<a href="${href}" style="color:${COLORS.gold};font-weight:600;text-decoration:underline;">👉 View ${cat} Collection</a>`);
    setReplies([
      { label: "🛍️ More Collections", action: () => flowBrowse() },
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "📞 Talk to Us", action: () => flowContact() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const flowShopAll = async () => {
    addUserMsg("Shop All");
    setReplies([]);
    await addBotMsg(`Here's our full collection! 🛍️`);
    await addBotMsg(`<a href="/shop" style="color:${COLORS.gold};font-weight:600;text-decoration:underline;">👉 Browse All Products</a>`);
    setReplies([
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "📞 Talk to Us", action: () => flowContact() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const flowOccasion = async () => {
    addUserMsg("Shop by Occasion");
    setReplies([]);
    await addBotMsg("What's the occasion? Let us help you find the perfect outfit! 🎊");
    setReplies([
      { label: "☀️ Everyday", action: () => flowOccasionPick("Everyday", "/shop?cat=Everyday") },
      { label: "💼 Office", action: () => flowOccasionPick("Office", "/shop?cat=Office") },
      { label: "🎉 Occasion / Party", action: () => flowOccasionPick("Occasion", "/shop?cat=Occasion") },
      { label: "⬅️ Back", action: () => backToMain() },
    ]);
  };

  const flowOccasionPick = async (occasion: string, href: string) => {
    addUserMsg(occasion);
    setReplies([]);
    await addBotMsg(`Perfect! Here's what we recommend for <b>${occasion.toLowerCase()}</b> wear:`);
    await addBotMsg(`<a href="${href}" style="color:${COLORS.gold};font-weight:600;text-decoration:underline;">👉 View ${occasion} Collection</a>`);
    setReplies([
      { label: "🎉 Other Occasions", action: () => flowOccasion() },
      { label: "🛍️ Browse All", action: () => flowBrowse() },
      { label: "📞 Talk to Us", action: () => flowContact() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const flowNewArrivals = async () => {
    addUserMsg("What's New");
    setReplies([]);
    await addBotMsg("Check out our latest arrivals! 🌟");
    await addBotMsg(`<a href="/shop" style="color:${COLORS.gold};font-weight:600;text-decoration:underline;">👉 View New Arrivals</a>`);
    setReplies([
      { label: "🛍️ Browse Collections", action: () => flowBrowse() },
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "📞 Talk to Us", action: () => flowContact() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const flowSizeGuide = async () => {
    addUserMsg("Size Guide");
    setReplies([]);
    await addBotMsg("Here's our quick size guide! 📏");
    await addBotMsg(
      `<b>Kurtis & Tops</b><br>` +
        `S — Bust 34" · Waist 28"<br>` +
        `M — Bust 36" · Waist 30"<br>` +
        `L — Bust 38" · Waist 32"<br>` +
        `XL — Bust 40" · Waist 34"<br>` +
        `XXL — Bust 42" · Waist 36"<br><br>` +
        `<b>Sarees</b>: Free size (5.5m with blouse piece)<br>` +
        `<b>Lehengas</b>: Custom sizing available!`
    );
    await addBotMsg("Not sure about your size? WhatsApp us and we'll help! 🤝");
    setReplies([
      { label: "📞 Contact on WhatsApp", action: () => flowContact() },
      { label: "🛍️ Browse Collections", action: () => flowBrowse() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const flowContact = async () => {
    addUserMsg("Contact Us");
    setReplies([]);
    await addBotMsg("We'd love to hear from you! Here's how to reach us:");
    await addBotMsg(
      `📱 <b>WhatsApp</b>: <a href="https://wa.me/919180181526" target="_blank" rel="noopener noreferrer" style="color:${COLORS.gold}">+91 91801 81526</a><br>` +
        `📧 <b>Email</b>: urvistudios2026@gmail.com<br>` +
        `📸 <b>Instagram</b>: <a href="https://www.instagram.com/urvi.studios" target="_blank" rel="noopener noreferrer" style="color:${COLORS.gold}">@urvi.studios</a><br><br>` +
        `⏰ We reply within 2 hours (10am – 8pm IST)`
    );
    await addBotMsg("Or keep shopping — we're right here! 😊");
    setReplies([
      { label: "🛍️ Browse Collections", action: () => flowBrowse() },
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "🏠 Start Over", action: () => backToMain() },
    ]);
  };

  const backToMain = async () => {
    addUserMsg("Start Over");
    setReplies([]);
    await addBotMsg("Of course! What would you like to do? 😊");
    setReplies([
      { label: "🛍️ Browse Collections", action: () => flowBrowse() },
      { label: "🎉 Shop by Occasion", action: () => flowOccasion() },
      { label: "✨ What's New", action: () => flowNewArrivals() },
      { label: "📏 Size Guide", action: () => flowSizeGuide() },
      { label: "📞 Contact Us", action: () => flowContact() },
    ]);
  };

  /* ─── Handlers ─── */

  const handleOpen = () => {
    setOpen(true);
    setFabVisible(false);
    if (messages.length === 0) {
      startConversation();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setFabVisible(true), 350);
  };

  if (!visible) return null;

  /* ─── Render ─── */
  return (
    <>
      {/* Floating button */}
      {fabVisible && !open && (
        <button
          onClick={handleOpen}
          aria-label="Open shopping assistant"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9000,
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-end",
            gap: 0,
            border: "none",
            background: "none",
            padding: 0,
            transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            animation: "urviBotFadeIn 0.5s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {/* Speech label */}
          <span
            style={{
              position: "absolute",
              bottom: 60,
              right: 0,
              background: COLORS.olive,
              color: COLORS.ivory,
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "10px 10px 2px 10px",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(63,72,39,0.15)",
              animation: "urviBotLabelBounce 3s ease-in-out infinite",
            }}
          >
            Need help shopping? 👋
          </span>

          {/* Mascot A */}
          <span style={{ position: "relative" }}>
            <img
              src={imageA}
              alt="Nikhila"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                objectFit: "cover",
                objectPosition: "top",
                border: `2.5px solid ${COLORS.gold}`,
                background: COLORS.ivory,
              }}
            />
          </span>
          {/* Mascot B */}
          <img
            src={imageB}
            alt="Shristi"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "top",
              border: `2.5px solid ${COLORS.gold}`,
              background: COLORS.ivory,
              marginLeft: -14,
            }}
          />
        </button>
      )}

      {/* Chat panel */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          height: 560,
          maxHeight: "calc(100vh - 48px)",
          background: "var(--card-bg, #ffffff)",
          borderRadius: 20,
          boxShadow: "0 8px 40px rgba(63,72,39,0.15), 0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 9001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: open ? "scale(1) translateY(0)" : "scale(0.5) translateY(40px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
          transformOrigin: "bottom right",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: COLORS.olive,
            padding: "16px 16px 14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src={imageA}
              alt="Nikhila"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `2px solid ${COLORS.gold}`,
                objectFit: "cover",
                objectPosition: "top",
                background: COLORS.ivory,
              }}
            />
            <img
              src={imageB}
              alt="Shristi"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `2px solid ${COLORS.gold}`,
                objectFit: "cover",
                objectPosition: "top",
                background: COLORS.ivory,
                marginLeft: -10,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ivory }}>Nikhila & Shristi</div>
            <div style={{ fontSize: 11, color: COLORS.sand, marginTop: 2, opacity: 0.8 }}>
              Your shopping assistants
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close chat"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.12)",
              color: COLORS.ivory,
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.type === "bot" ? "flex-start" : "flex-end",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 16,
                borderBottomLeftRadius: msg.type === "bot" ? 4 : 16,
                borderBottomRightRadius: msg.type === "user" ? 4 : 16,
                background: msg.type === "bot" ? COLORS.sand : COLORS.olive,
                color: msg.type === "bot" ? COLORS.olive : COLORS.ivory,
                fontSize: 13.5,
                lineHeight: 1.5,
                animation: "urviBotMsgIn 0.3s ease",
              }}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
          ))}

          {/* Typing indicator */}
          {typing && (
            <div
              style={{
                alignSelf: "flex-start",
                display: "flex",
                gap: 4,
                padding: "10px 14px",
                background: COLORS.sand,
                borderRadius: 16,
                borderBottomLeftRadius: 4,
              }}
            >
              <span style={{ ...dotStyle, animationDelay: "0s" }} />
              <span style={{ ...dotStyle, animationDelay: "0.2s" }} />
              <span style={{ ...dotStyle, animationDelay: "0.4s" }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        {replies.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "8px 16px 12px",
              flexShrink: 0,
            }}
          >
            {replies.map((r, i) => (
              <button
                key={i}
                onClick={r.action}
                style={{
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${COLORS.gold}`,
                  background: "transparent",
                  color: COLORS.gold,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = COLORS.gold;
                  e.currentTarget.style.color = COLORS.ivory;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = COLORS.gold;
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            textAlign: "center",
            fontSize: 10,
            color: COLORS.sage,
            flexShrink: 0,
            borderTop: `1px solid ${COLORS.sand}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ opacity: 0.5 }}>Powered by Urvi Studios</span>
          {onHidePermanently && (
            <button
              onClick={() => { handleClose(); onHidePermanently(); }}
              style={{
                background: "none",
                border: "none",
                color: COLORS.sage,
                fontSize: 10,
                cursor: "pointer",
                opacity: 0.6,
                padding: "2px 4px",
                textDecoration: "underline",
              }}
            >
              Don\u2019t show again
            </button>
          )}
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes urviBotFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes urviBotLabelBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes urviBotMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes urviBotDot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}

const dotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  background: COLORS.gold,
  borderRadius: "50%",
  animation: "urviBotDot 1.4s ease-in-out infinite",
};
