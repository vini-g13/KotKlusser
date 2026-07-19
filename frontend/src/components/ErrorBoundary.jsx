import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("Onverwachte fout in de app:", error, errorInfo);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#0B0A14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            backgroundColor: "#161425",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "384px",
            width: "100%",
            textAlign: "center",
          }}>
            <h1 style={{
              color: "#F8FAFC",
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}>
              Er ging iets mis
            </h1>
            <p style={{ color: "#94A3B8", fontSize: "14px", marginBottom: "24px" }}>
              Er is een onverwachte fout opgetreden. Probeer de pagina opnieuw te laden.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                width: "100%",
                height: "48px",
                backgroundColor: "#6366F1",
                color: "#F8FAFC",
                border: "none",
                borderRadius: "8px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Terug naar de homepage
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
