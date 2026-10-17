import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    loop_param = "asyncio.windows_events:SelectorEventLoop" if sys.platform == "win32" else "auto"
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False, app_dir="backend", loop=loop_param)
