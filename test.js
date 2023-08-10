
document.addEventListener("mousemove", (event) = > {
    const cursorHighlight = document.querySelector(".cursor-highlight");
    cursorHighlight.style.left = event.clientX + "px";
    cursorHighlight.style.top = event.clientY + "px";
});

