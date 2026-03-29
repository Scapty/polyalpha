import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MenuVertical({
  menuItems = [],
  color = "#2DD4A8",
  skew = -3,
  activeItem = "",
}) {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "fit-content" }}>
      {menuItems.map((item, index) => {
        const isActive = activeItem === item.id;
        return (
          <motion.div
            key={item.id || index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              color: isActive ? color : "var(--text-primary)",
            }}
            initial="initial"
            whileHover="hover"
            animate={isActive ? "hover" : "initial"}
            onClick={() => navigate(item.href)}
          >
            <motion.div
              variants={{
                initial: { x: "-100%", color: "inherit", opacity: 0 },
                hover: { x: 0, color, opacity: 1 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <ArrowRight strokeWidth={3} size={28} />
            </motion.div>
            <motion.span
              variants={{
                initial: { x: -32, color: "inherit" },
                hover: { x: 0, color, skewX: skew },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                textDecoration: "none",
              }}
            >
              {item.label}
            </motion.span>
            {item.number && (
              <motion.span
                variants={{
                  initial: { opacity: 0.3 },
                  hover: { opacity: 1, color },
                }}
                transition={{ duration: 0.3 }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.3,
                  marginLeft: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {item.number}
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
