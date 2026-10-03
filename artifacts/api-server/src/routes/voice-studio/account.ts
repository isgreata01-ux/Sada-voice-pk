import { Router, type IRouter } from "express";
import { GetAccountResponse } from "@workspace/api-zod";
import { accountResponse, getSignedInAccount } from "./auth";

const router: IRouter = Router();

router.get("/account", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account) return;
  res.json(GetAccountResponse.parse(accountResponse(account)));
});

export default router;