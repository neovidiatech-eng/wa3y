import {
  errorResponse,
  successResponse,
  asyncHandler,
} from "../../Utils/Response.js";
import * as db from "../../database/dbService.js";

export const getFeedback = asyncHandler(async (req, res, next) => {

  const {page,limit,search}=req.query;
  const where={}

 if (search) {
  where.OR = [
    {
      reviewee: {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
    },
    {
      reviewer: {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
    },
  ];
}

  const feedbacks = await db.findManyWithPaginationAndCount({
    model: "Review",
    page,
    limit,
    where,
  select: {
  id: true,
  schedule:true,
  reviewer:true,
  reviewee: true,
  rating: true,
  comment: true,
  role: true,
  isHidden: true,
  createdAt: true,
}
   
  });


  return successResponse({
    res,
    req,
    status: 200,
    message: "FETCH_SUCCESS",
    data: { feedbacks },
  });
});

