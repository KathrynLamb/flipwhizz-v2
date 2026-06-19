export default function Loading() {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-white">
        <div className="relative h-12 w-12">
          <div
            className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent"
            style={{
              borderTopColor: "#F2546A",
              borderRightColor: "#F7A93E",
              borderBottomColor: "#8AC7E0",
              borderLeftColor: "#A270C9",
            }}
          />
        </div>
      </div>
    );
  }